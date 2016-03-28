import * as fs from 'fs';
import * as github from 'github-api';
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
      version: '3.0.0',
      token: this.ghToken,
      auth: 'oauth'
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

  updateDependency(dep, gitUrl) {
    console.log(`Package ${dep} at ${gitUrl}`);
    let [owner, repo] = parseSlug(gitUrl);
    repo = this.githubApi.getRepo(owner, repo);
    repo.read(this.targetBranch, PACKAGE_JSON, (err, data) => {
      let pkg = data;
      console.log(1, pkg['devDependencies']);
      console.log(2, pkg[pkg['devDependencies']][this.packageName]);
      let key = ['dependencies', 'devDependencies', 'peerDependencies'].find((k) => pkg[k][this.packageName]);
      console.log(key);
      if (!key) {
        console.log(`This package doesn't have ${this.packageName} as dependency`);
        return;
      }
      let currentVersion = pkg[key][this.packageName];
      if (currentVersion !== this.packageVersion) {
        console.log(`Updating ${this.packageName} version from ${currentVersion} to ${this.packageVersion}`);
      } else {
        console.log(`This package already have ${this.packageName} at version ${this.packageVersion}`);
        return;
      }
    });
  }

  run() {
    this.readConfig();
    this.update();
  }
}
