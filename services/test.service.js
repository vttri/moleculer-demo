"use strict";

const { MoleculerClientError } = require("moleculer").Errors;

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const DbService = require("../mixins/db.mixin");
const CacheCleanerMixin = require("../mixins/cache.cleaner.mixin");

module.exports = {
	name: "test",
	actions: {
		test(ctx) {
			console.log(ctx.params, ctx.meta);
		},
		list(ctx) {
			return [
				{ name: "Apples", price: 6 },
				{ name: "Oranges", price: 3 },
				{ name: "Bananas", price: 2 },
			];
		},
		get(ctx) {
			console.log(ctx.params.id);
			return ctx.params.id;
		},
		create(ctx) {
			console.log(ctx.params);
		},
		update(ctx) {
			console.log(ctx.params);
		},
		remove(ctx) {
			console.log(ctx.params);
		},
	},
	events: {
		"users.create"(ctx) {
			this.logger.info("new user created emit");
		},
	},
	methods: {},
};
