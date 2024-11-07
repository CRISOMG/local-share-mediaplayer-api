#!/bin/bash


# cd dist;
# pm2 delete all;
# pm2 flush;
# pm2 start ./dist/index.js --name express-api;
# pm2 start ecosystem.config.cjs --env production
# pm2 logs express-api;

# this must be executet by CMD ["pm2-runtime", "start", "/api/ecosystem.config.cjs"] in dockerfile or ("start": "pm2 start ecosystem.config.cjs") in package.json from yarn start 

pm2 start dist/index.js

