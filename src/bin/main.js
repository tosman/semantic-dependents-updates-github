#!/usr/bin/env node
require('babel-register');
require('babel-polyfill');

let DependentsUpdater = require('../DependentsUpdater');

new DependentsUpdater.default().run();
