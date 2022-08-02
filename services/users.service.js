"use strict";

const { MoleculerClientError } = require("moleculer").Errors;

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const DbService = require("../mixins/db.mixin");
const CacheCleanerMixin = require("../mixins/cache.cleaner.mixin");

module.exports = {
	name: "users",
	mixins: [
		DbService("users"),
		CacheCleanerMixin(["cache.clean.users", "cache.clean.follows"]),
	],

	hooks: {
		before: {
			create: [
				function test(ctx) {
					ctx.params.user.image = "link image test";
				},
			],
		},
		after: {
			"*": function (ctx, res) {
				// Remove password
				res.afterHook = "after hook";

				// Please note, must return result (either the original or a new)
				return res;
			},
		},
		error: {
			"*": function (ctx, err) {
				this.logger.error(
					`Error occurred when '${ctx.action.name}' action was called`,
					err
				);

				// Throw further the error
				throw err;
			},
		},
	},

	/**
	 * Default settings
	 */
	settings: {
		/** REST Basepath */
		rest: "/",
		/** Secret for JWT */
		JWT_SECRET: process.env.JWT_SECRET || "jwt-conduit-secret",

		/** Public fields */
		fields: ["_id", "username", "email", "bio", "image"],

		/** Validator schema for entity */
		entityValidator: {
			username: { type: "string", min: 2 },
			password: { type: "string", min: 6 },
			email: { type: "email" },
			bio: { type: "string", optional: true },
			image: { type: "string", optional: true },
		},
	},

	/**
	 * Actions
	 */
	actions: {
		/**
		 * Register a new user
		 *
		 * @actions
		 * @param {Object} user - User entity
		 *
		 * @returns {Object} Created entity & token
		 */
		create: {
			rest: "POST /users",
			params: {
				user: { type: "object" },
			},
			async handler(ctx) {
				let entity = ctx.params.user;
				await this.validateEntity(entity);
				if (entity.username) {
					const found = await this.adapter.findOne({
						username: entity.username,
					});
					if (found)
						throw new MoleculerClientError("Username is exist!", 422, "", [
							{ field: "username", message: "is exist" },
						]);
				}

				if (entity.email) {
					const found = await this.adapter.findOne({ email: entity.email });
					if (found)
						throw new MoleculerClientError("Email is exist!", 422, "", [
							{ field: "email", message: "is exist" },
						]);
				}

				entity.password = bcrypt.hashSync(entity.password, 10);
				entity.bio = entity.bio || "";
				entity.image = entity.image || null;
				entity.createdAt = new Date();
				const doc = await this.adapter.insert(entity);
				this.broker.emit("users.create", doc);
				const user = await this.transformDocuments(ctx, {}, doc);
				const json = await this.transformEntity(user, true, ctx.meta.token);
				return json;
			},
		},

		/**
		 * Login with username & password
		 *
		 * @actions
		 * @param {Object} user - User credentials
		 *
		 * @returns {Object} Logged in user with token
		 */
		login: {
			rest: "POST /users/login",
			params: {
				user: {
					type: "object",
					props: {
						email: { type: "email" },
						password: { type: "string", min: 1 },
					},
				},
			},
			async handler(ctx) {
				const { email, password } = ctx.params.user;

				const user = await this.adapter.findOne({ email });
				if (!user)
					throw new MoleculerClientError(
						"Email or password is invalid!",
						422,
						"",
						[{ field: "email", message: "is not found" }]
					);

				const res = await bcrypt.compare(password, user.password);
				if (!res)
					throw new MoleculerClientError("Wrong password!", 422, "", [
						{ field: "email", message: "is not found" },
					]);

				// Transform user entity (remove password and all protected fields)
				const doc = await this.transformDocuments(ctx, {}, user);
				return await this.transformEntity(doc, true, ctx.meta.token);
			},
		},

		/**
		 * Get user by JWT token (for API GW authentication)
		 *
		 * @actions
		 * @param {String} token - JWT token
		 *
		 * @returns {Object} Resolved user
		 */
		resolveToken: {
			cache: {
				keys: ["token"],
				ttl: 60 * 60, // 1 hour
			},
			params: {
				token: "string",
			},
			async handler(ctx) {
				const decoded = await new this.Promise((resolve, reject) => {
					jwt.verify(
						ctx.params.token,
						this.settings.JWT_SECRET,
						(err, decoded) => {
							if (err) return reject(err);

							resolve(decoded);
						}
					);
				});

				if (decoded.id) return this.getById(decoded.id);
			},
		},
		list: {
			auth: "required",
			rest: "GET /users",
		},

		get: {
			auth: "required",
			rest: "GET /users/:id",
		},

		update: {
			auth: "required",
			rest: "PUT /users/:id",
		},

		remove: {
			auth: "required",
			rest: "DELETE /users/:id",
		}
	},
	events: {
		"users.create"(ctx) {
			this.logger.info("new user created");
			this.broker.cacher.set(`user_${ctx.params._id}`, ctx.params);
		},
	},

	/**
	 * Methods
	 */
	methods: {
		/**
		 * Generate a JWT token from user entity
		 *
		 * @param {Object} user
		 */
		generateJWT(user) {
			const today = new Date();
			const exp = new Date(today);
			exp.setDate(today.getDate() + 60);

			return jwt.sign(
				{
					id: user._id,
					username: user.username,
					exp: Math.floor(exp.getTime() / 1000),
				},
				this.settings.JWT_SECRET
			);
		},

		/**
		 * Transform returned user entity. Generate JWT token if neccessary.
		 *
		 * @param {Object} user
		 * @param {Boolean} withToken
		 */
		transformEntity(user, withToken, token) {
			if (user) {
				//user.image = user.image || "https://www.gravatar.com/avatar/" + crypto.createHash("md5").update(user.email).digest("hex") + "?d=robohash";
				user.image = user.image || "";
				if (withToken) user.token = token || this.generateJWT(user);
			}

			return { user };
		},
	},
};
