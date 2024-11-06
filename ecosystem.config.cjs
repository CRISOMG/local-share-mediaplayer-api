module.exports = {
    apps: [
        {
            name: 'express-api',
            port: '3002',
            script: './scripts/start.sh',
            env_production: {
                NODE_ENV: "production",
                PORT: 3002,
            },
        },
    ]
}
