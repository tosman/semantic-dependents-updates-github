# semantic-dependents-updates-github

Creates Github Pull Requests to update current package version in dependent projects.

[![Travis build status](http://img.shields.io/travis/artemv/semantic-dependents-updates-github.svg?style=flat)](https://travis-ci.org/artemv/semantic-dependents-updates-github)
[![Dependency Status](https://david-dm.org/artemv/semantic-dependents-updates-github.svg)](https://david-dm.org/artemv/semantic-dependents-updates-github)
[![devDependency Status](https://david-dm.org/artemv/semantic-dependents-updates-github/dev-status.svg)](https://david-dm.org/artemv/semantic-dependents-updates-github#info=devDependencies)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

### Project status
This is work in progress - don't use yet.

### Installation
Install the package:
```
npm install --save-dev @egis/semantic-dependents-updates-github
```

### Usage

* Create a GitHub token to be used by semantic-dependents-updates-github and put it to GH_TOKEN env variable.
You can also take (any of) GH_TOKEN created by https://github.com/semantic-release/semantic-release setup: it will
print it if you choose 'Other' CI instead of Travis.

* Define the dependent projects to be updated in package.json, e.g.:
```
  ...
  "semantic-dependents": {
    "@egis/egis-ui": "git@github.com:artemv/EgisUI.git",
    "@egis/esign": "git@github.com:artemv/eSign.git",
    "@egis/portal-app": "git@github.com:artemv/Portal.git"
  },
  ...
```
Here we tell semantic-dependents-updates-github to create PRs to change version of the current package to the one
defined in package.json in given GitHub repos.

* Use the 'semantic-dependents-updates-github' binary script in package.json' scripts section - this will create the
PRs. Example for integration with semantic-release:
```
  ...
  "scripts": {
    "update-dependents": "semantic-dependents-updates-github",
    "semantic-release": "semantic-release pre && npm publish && npm run update-dependents",
  },
  ...

```