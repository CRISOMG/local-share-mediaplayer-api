#!/bin/bash


cd dist;
pm2 delete all;
NODE_ENV='production';
pm2 start index.js --name express-api;
pm2 logs express-api;

