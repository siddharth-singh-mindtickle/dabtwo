const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    timestamp: true,
    format: winston.format.combine(winston.format.colorize(), winston.format.timestamp(), winston.format.padLevels(), winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)),
    defaultMeta: {service: 'barley-task-manager'},
    transports: [
        new winston.transports.File({
            timestamp: true,
            filename: 'error.log',
            level: 'error'
        }),
        new winston.transports.File({
            timestamp: true,
            filename: 'info.log'
        }),
        new winston.transports.Console({
            timestamp: true
        })
    ]
});

module.exports = logger;