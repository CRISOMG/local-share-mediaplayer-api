module.exports = {
    apps: [
        {
            name: 'express-api',
            port: '3002',
            script: 'dist/index.js',
            env_production: {
                NODE_ENV: "production",
                PORT: 3002,
            },
        },
    ]
}
