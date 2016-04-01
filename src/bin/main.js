#!/usr/bin/env node

import 'babel-polyfill';

import DependentsUpdater from '../DependentsUpdater';

new DependentsUpdater().run();
