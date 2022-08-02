"use strict";

module.exports = {
	namespace: "conduit",
	//transporter: "TCP",
	logger: true,
	logLevel: "info",
	cacher: {
		type: "Redis",
		options: {
			// Prefix for keys
			prefix: "MOL",
			monitor: false,
			// Redis settings
			redis: {
				host: "localhost",
				port: 6379
			},
		},
	},
	metrics: false,

	tracing: {
		enabled: true,
		exporter: [
			{
				type: "Console",
				options: {
					width: 100,
					colors: true,
				},
			},
		],
	},

	validator: true,
};
