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
    this.deps = pkg['semantic-dependents'];
    this.ghToken = env.GH_TOKEN || env.GITHUB_TOKEN;
    this.githubApi = new GitHubApi({
      version: '3.0.0'
    });

    this.githubApi.authenticate({
      token: this.ghToken,
      type: 'oauth'
    });

    this.targetBranch = 'master';
  }

  update() {
    if (this.deps && Object.keys(this.deps).length > 0) {
      console.log(`Updating this package ${this.packageName} to version ${this.packageVersion} in dependent packages:`);
    }
    for (let dep of Object.keys(this.deps)) {
      this.updateDependency(dep, this.deps[dep]);
    }
  }

  requestUpdate(packageName, packageVersion, newPkgBody) {
    let msg = {
      "message": `chore(package): update ${packageName} to version ${packageVersion}`,
      "committer": {
        "name": "semantic-dependents-updates-github bot",
        "email": "semadep@nowhere.io"
      },
      "content": "bXkgdXBkYXRlZCBmaWxlIGNvbnRlbnRz",
      "sha": "329688480d39049927147c162b9d2deaf885005f"
    }
  }

  createPullRequest(packageName, packageVersion, newPkgBody) {
    let random = `${Date.now()}`;
    let branchName = `${this.branchNameBase}-${packageVersion}-${random}`;
    let sha = 'a961ce930b0570bdf3c7e9dbeaa3abe198ab9150';
    let msg = {
      user: this.gitRepoOwner,
      owner: this.gitRepoOwner,
      repo: this.gitRepo,
      ref: `refs/heads/${branchName}`,
      sha: sha
    };
    this.githubApi.gitdata.createReference(msg, (err, data) => {
      if (err) {
        throw new Error(`Couldn't create a new branch from sha ${sha}: ${err}`);
      }
      this.requestUpdate(packageName, packageVersion, newPkgBody)
    });

  }

  processTargetPackageJson(err, data) {
    let rawPkg = data;
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
      console.log(`Updating ${this.packageName} version from ${currentVersion} to ${this.packageVersion}`);
      rawPkg = rawPkg.replace(`"${this.packageName}": "${currentVersion}"`,
          `"${this.packageName}": "${this.packageVersion}"`);
      this.createPullRequest(this.packageName, this.packageVersion, rawPkg);
    } else {
      console.log(`This package already have ${this.packageName} at version ${this.packageVersion}`);
      return;
    }
  }

  updateDependency(dep, info) {
    let gitUrl = info.repo;
    this.branchNameBase = info.branchNameBase;
    console.log(`Trying to update dependent package ${dep} at ${gitUrl}`);
    let [owner, repo] = parseSlug(gitUrl);
    this.gitRepo = repo;
    this.gitRepoOwner = owner;
    this.githubApi.repos.getContent({
          user: this.gitRepoOwner,
          repo: this.gitRepo,
          ref: this.targetBranch,
          path: PACKAGE_JSON,
          headers: {Accept: 'application/vnd.github.v3.raw'}
        },
        this.processTargetPackageJson.bind(this));
  }

  run() {
    this.readConfig();
    this.update();
  }
}
