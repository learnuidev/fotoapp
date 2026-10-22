#!/usr/bin/env node
/**
 * `cdk synth` / `cdk deploy` / `cdk diff` start here.
 *
 * Nothing is read from a config file: the stage comes from the CDK context and the
 * account and region from the CLI's own environment, so one repository can be deployed
 * to a dev account and a production one without a branch.
 */
import { App } from 'aws-cdk-lib';
import { buildApp } from '../src/app';

const app = new App();
buildApp(app, app.node.tryGetContext('foto') ?? { ...app.node.getAllContext() });
app.synth();
