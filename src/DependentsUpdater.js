import * as fs from "fs";
import * as github from "github";
import * as parseGithubUrl from "@bahmutov/parse-github-repo-url";
var Promise = require("bluebird"); // npm install bluebird

let env = process.env;
const GitHubApi = github.default;
const parseSlug = parseGithubUrl.default;

const PACKAGE_JSON = "package.json";
const GH_TOKEN_KEY = "GH_TOKEN";
const GH_RELEASE_PREFIX = `git+ssh://git@github.com:Evolent-Health`;

export default class DependentsUpdater {
  readConfig() {
    let pkg = JSON.parse(fs.readFileSync("src/package.json"));
    this.packageName = pkg.name;
    this.config = pkg["semantic-dependents-updates"];

    this.packageVersion = pkg.version;
    this.deps = this.config.dependents;
    this.ghToken = env[GH_TOKEN_KEY] || env.GITHUB_TOKEN;
    this.githubApi = new GitHubApi({
      version: "3.0.0",
      Promise: Promise
    });
  }

  update() {
    if (this.deps && Object.keys(this.deps).length > 0) {
      console.log(
        `Updating this package ${this.packageName} to version ${this
          .packageVersion} in dependent packages:`
      );
    }
    for (let dep of Object.keys(this.deps)) {
      this.updateDependency(dep, this.deps[dep]);
    }
  }

  async updateFileInBranch(rawPkg, config) {
    let msg = Object.assign(this.gitRepoOptions(config), {
      path: PACKAGE_JSON,
      branch: config.newBranch,
      message: `chore(package): update ${this.packageName} to version ${this
        .packageVersion}`,
      author: Object.assign(
        {
          name: "semantic-dependents-updates-github bot",
          email: "semadep@nowhere.io"
        },
        this.config.author || {}
      ),
      sha: config.oldPackageSha
    });
    let msgWithFile = Object.assign(
      {
        content: new Buffer(rawPkg).toString("base64")
      },
      msg
    );

    try{
      let data = await this.githubApi.repos.updateFile(msgWithFile);
      config.updateCommitSha = data.data.commit.sha;

    } catch(e){
      throw new Error(
            `Couldn't commit a change  ${JSON.stringify(
              msg
            )} for ${config.targetPackageName}: ${e}`
          );
    }
  }

  async createPullRequest(config) {
    let msg = Object.assign(this.gitRepoOptions(config), {
      title: `Update ${this.packageName} to version ${this.packageVersion}`,
      base: config.branch,
      head: config.newBranch
    });

    console.log(msg);
    try{ 
      let data = await this.githubApi.pullRequests.create(msg);
    } catch(e){
      throw new Error(
            `Couldn't create a PR for ${config.targetPackageName}: ${e}`
      );
    }
  }

  async getCurrentHead(config) {
    let msg = Object.assign(this.gitRepoOptions(config), {
      branch: config.branch
    });

    try {
      let data = await this.githubApi.repos.getBranch(msg);
      return data.data.commit.sha
    } catch (e) {
      throw new Error(
        `Couldn't get current head of ${config.targetPackageName}: ${err}`
      );
    }
  }

  createBranch(config) {
    let random = `${Date.now()}`;
    config.newBranch = `${this.config.branchNameBase || "autoupdate"}-${this
      .packageVersion}-${random}`;
    return new Promise(resolve => {
      this.getCurrentHead(config).then(sha => {
        let msg = Object.assign(this.gitRepoOptions(config), {
          ref: `refs/heads/${config.newBranch}`,
          sha: sha
        });

        this.githubApi.gitdata.createReference(msg, (err, data) => {
          if (err) {
            throw new Error(
              `Couldn't create a new branch for ${config.targetPackageName} from sha ${sha}: ${err}`
            );
          }
          resolve();
        });
      });
    });
  }

  async processTargetPackageJson(rawPkg, config) {

    function createVersionUrl(useGitHubReleases, packageName, packageVersion){
      return useGitHubReleases ? `${GH_RELEASE_PREFIX}/${packageName}.git#${packageVersion}`: packageVersion;
    }

    let pkg = JSON.parse(rawPkg.data, "utf8");
    let key = [
      "dependencies",
      "devDependencies",
      "peerDependencies"
    ].find(k => {
      return (pkg[k] || {})[this.packageName];
    });
    if (!key) {
      console.log(
        `Package ${config.targetPackageName} doesn't have ${this
          .packageName} as dependency`
      );
      return;
    }
    let currentVersion = pkg[key][this.packageName];
    if (currentVersion !== this.packageVersion) {
      console.log(
        `Updating ${this
          .packageName} version at ${config.targetPackageName} from ${currentVersion} to ` +
          this.packageVersion
      );

      const packageVersionUrl = createVersionUrl(this.config.useGitHubReleases, this.packageName, this.packageVersion);

      rawPkg = rawPkg.data.replace(
        `"${this.packageName}": "${currentVersion}"`,
        `"${this.packageName}": "${packageVersionUrl}"`
      );



     try{
        await this.createBranch(config);
        await this.updateFileInBranch(rawPkg, config);
        await this.createPullRequest(config);

        console.log(`Created a PR for ${config.targetPackageName}`)
     } catch (e){
       throw new Error(e);
     }

    } else {
      console.log(
        `Package ${config.targetPackageName} already have ${this
          .packageName} at version ${this.packageVersion}`
      );
      return;
    }
  }

  gitRepoOptions(config) {
    return {
      owner: config.gitRepoOwner,
      repo: config.gitRepo
    };
  }

  async getTargetPackageJson(options, config) {
    try {
      let obj = Object.assign(
        this.gitRepoOptions(config),
        {
          ref: config.branch,
          path: PACKAGE_JSON
        },
        options
      );
      let data = await this.githubApi.repos.getContent(obj);

      return data;
    } catch (e) {
      throw new Error(
        `Couldn't get ${PACKAGE_JSON} of ${config.targetPackageName}: ${e}`
      );
    }
  }

  updateDependency(dep, gitUrl) {
    let config = {};
    config.targetPackageName = dep;
    config.branch = this.config.branch || "master";
    console.log(`Trying to update dependent package ${dep} at ${gitUrl}`);
    let [owner, repo] = parseSlug(gitUrl);
    config.gitRepo = repo;
    config.gitRepoOwner = owner;



    this.getTargetPackageJson({}, config)
      .then(data => {
        config.oldPackageSha = data.data.sha;
      })
      .then(() => {
        this.getTargetPackageJson(
          { headers: { Accept: "application/vnd.github.v3.raw" } },
          config
        ).then(data => {
          this.processTargetPackageJson(data, config);
        });
      });
      
  }

  authenticate() {
    if (!this.ghToken) {
      throw `You need to set the ${GH_TOKEN_KEY} env variable`;
    }
    this.githubApi.authenticate({
      token: this.ghToken,
      type: "oauth"
    });
  }

  run() {
    this.readConfig();
    this.authenticate();
    this.update();
  }
}
