import * as fs from 'fs';
import * as github from 'github';
import * as parseGithubUrl from '@bahmutov/parse-github-repo-url';

let env = process.env;
const GitHubApi = github.default;
const parseSlug = parseGithubUrl.default;

const PACKAGE_JSON = 'package.json';

export default class DependentsUpdater {
  readConfig() {
    let pkg = JSON.parse(fs.readFileSync('./package.json'));
    this.packageName = pkg.name;
    this.packageVersion = pkg.version;
    this.config = pkg['semantic-dependents-updates'];
    this.deps = this.config.dependents;
    this.ghToken = env.GH_TOKEN || env.GITHUB_TOKEN;
    this.githubApi = new GitHubApi({
      version: '3.0.0'
    });

    this.githubApi.authenticate({
      token: this.ghToken,
      type: 'oauth'
    });
  }

  update() {
    if (this.deps && Object.keys(this.deps).length > 0) {
      console.log(`Updating this package ${this.packageName} to version ${this.packageVersion} in dependent packages:`);
    }
    for (let dep of Object.keys(this.deps)) {
      this.updateDependency(dep, this.deps[dep]);
    }
  }

  updateFileInBranch(rawPkg, config) {
    let msg = Object.assign(this.gitRepoOptions(config), {
      path: PACKAGE_JSON,
      branch: config.newBranch,
      message: `chore(package): update ${this.packageName} to version ${this.packageVersion}`,
      author: Object.assign({
            name: 'semantic-dependents-updates-github bot',
            email: 'semadep@nowhere.io'
          }, this.config.author || {}),
      sha: config.oldPackageSha
    });
    let msgWithFile = Object.assign({
      content: 'bXkgdXBkYXRlZCBmaWxlIGNvbnRlbnRz'
    }, msg);
    return new Promise((resolve) => {
      this.githubApi.repos.updateFile(msgWithFile, (err, data) => {
        if (err) {
          throw new Error(`Couldn't commit a change  ${JSON.stringify(msg)} for ${config.targetPackageName}: ${err}`);
        }
        resolve();
      });
    });
  }

  createPullRequest(config) {
    let msg = Object.assign(this.gitRepoOptions(config), {
      title: `Update ${this.packageName} to version ${this.packageVersion}`,
      base: config.targetBranch,
      head: config.newBranch
    });
    return new Promise((resolve) => {
      this.githubApi.pullRequests.create(msg, (err, data) => {
        if (err) {
          throw new Error(`Couldn't create a PR for ${config.targetPackageName}: ${err}`);
        }
        resolve();
      });
    });
  }

  getCurrentHead(config) {
    let msg = Object.assign(this.gitRepoOptions(config), {branch: config.targetBranch});
    return new Promise((resolve) => {
      this.githubApi.repos.getBranch(msg, (err, data) => {
        if (err) {
          throw new Error(`Couldn't get current head of ${config.targetPackageName}: ${err}`);
        }
        resolve(data.commit.sha);
      });
    });
  }

  createBranch(config) {
    let random = `${Date.now()}`;
    config.newBranch = `${this.config.branchNameBase}-${this.packageVersion}-${random}`;
    return new Promise((resolve) => {
      this.getCurrentHead(config).then((sha) => {
        let msg = Object.assign(this.gitRepoOptions(config), {
          ref: `refs/heads/${config.newBranch}`,
          sha: sha
        });

        this.githubApi.gitdata.createReference(msg, (err, data) => {
          if (err) {
            throw new Error(`Couldn't create a new branch for ${config.targetPackageName} from sha ${sha}: ${err}`);
          }
          resolve();
        });
      });
    });
  }

  processTargetPackageJson(rawPkg, config) {
    let pkg = JSON.parse(rawPkg, 'utf8');
    let key = ['dependencies', 'devDependencies', 'peerDependencies'].find((k) => {
      return (pkg[k] || {})[this.packageName];
    });
    if (!key) {
      console.log(`This package doesn't have ${this.packageName} as dependency`);
      return;
    }
    let currentVersion = pkg[key][this.packageName];
    if (currentVersion !== this.packageVersion) {
      console.log(`Updating ${this.packageName} version at ${config.targetPackageName} from ${currentVersion} to ` +
          this.packageVersion);

      rawPkg = rawPkg.replace(`"${this.packageName}": "${currentVersion}"`,
          `"${this.packageName}": "${this.packageVersion}"`);
      this.createBranch(config).then(() => {
        return this.updateFileInBranch(rawPkg, config);
      }).then(() => {
        this.createPullRequest(config).then(() => console.log(`Created a PR for ${config.targetPackageName}`));
      });
    } else {
      console.log(`This package already have ${this.packageName} at version ${this.packageVersion}`);
      return;
    }
  }

  gitRepoOptions(config) {
    return {
      user: config.gitRepoOwner,
      repo: config.gitRepo
    };
  }

  getTargetPackageJson(options, config) {
    return new Promise((resolve) => {
      this.githubApi.repos.getContent(Object.assign(this.gitRepoOptions(config), {
            ref: config.targetBranch,
            path: PACKAGE_JSON
          }, options), (err, data) => {
            if (err) {
              throw new Error(`Couldn't get ${PACKAGE_JSON} of ${config.targetPackageName}: ${err}`);
            }
            resolve(data);
          }
      );
    });
  }

  updateDependency(dep, gitUrl) {
    let config = {};
    config.targetPackageName = dep;
    config.targetBranch = this.config.targetBranch || 'master';
    console.log(`Trying to update dependent package ${dep} at ${gitUrl}`);
    let [owner, repo] = parseSlug(gitUrl);
    config.gitRepo = repo;
    config.gitRepoOwner = owner;
    this.getTargetPackageJson({}, config).then((data) => {
      config.oldPackageSha = data.sha;
    }).then(() => {
      this.getTargetPackageJson({headers: {Accept: 'application/vnd.github.v3.raw'}}, config).then((data) => {
        this.processTargetPackageJson(data, config);
      });
    });
  }

  run() {
    this.readConfig();
    this.update();
  }
}
