import * as fs from 'fs';

export default class DependentsUpdater {
  run() {
    let pkg = JSON.parse(fs.readFileSync('./package.json'));
    console.log(pkg.version, pkg['semantic-dependents']);
  }
}
