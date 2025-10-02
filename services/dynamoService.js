// DynamoDB Service Wrapper for Dynamoose
export const WrapperService = (model) => {
	const Services = {}

	Services.create = async (objToSave) => {
		try {
			const newItem = new model(objToSave);
			const result = await newItem.save();
			console.log(result);
			return result;
		} catch (error) {
			throw new Error(`Create operation failed: ${error.message}`);
		}
	}

	Services.createMany = async (arrToSave) => {
		try {
			const results = [];
			// DynamoDB doesn't have a direct insertMany equivalent, so we batch create
			for (const item of arrToSave) {
				const newItem = new model(item);
				const result = await newItem.save();
				results.push(result);
			}
			return results;
		} catch (error) {
			throw new Error(`CreateMany operation failed: ${error.message}`);
		}
	}

	Services.getMany = async (criteria = {}, projection = null, options = {}) => {
		try {
			let query = model.scan();
			
			// Apply filters based on criteria
			Object.keys(criteria).forEach(key => {
				if (criteria[key] !== undefined && criteria[key] !== null) {
					if (typeof criteria[key] === 'object' && criteria[key].$in) {
						// Handle $in operator
						query = query.where(key).in(criteria[key].$in);
					} else if (typeof criteria[key] === 'object' && criteria[key].$regex) {
						// Handle regex - DynamoDB doesn't support regex, so we'll use contains
						query = query.where(key).contains(criteria[key].$regex);
					} else {
						query = query.where(key).eq(criteria[key]);
					}
				}
			});

			// Apply limit if specified
			if (options.limit) {
				query = query.limit(options.limit);
			}

			// Apply sort if specified
			if (options.sort) {
				// DynamoDB sorting is limited, but we can try to apply it
				const sortKey = Object.keys(options.sort)[0];
				const sortOrder = options.sort[sortKey] === 1 ? 'ascending' : 'descending';
				query = query.sort(sortKey, sortOrder);
			}

			const results = await query.exec();
			return results;
		} catch (error) {
			throw new Error(`GetMany operation failed: ${error.message}`);
		}
	}

	Services.getOne = async (criteria, projection = null, options = {}) => {
		try {
			// If criteria has an id field, use get() for better performance
			if (criteria.id) {
				const result = await model.get(criteria.id);
				return result || null;
			}

			// Otherwise use query
			let query = model.query();
			
			// Apply filters
			Object.keys(criteria).forEach(key => {
				if (criteria[key] !== undefined && criteria[key] !== null) {
					query = query.where(key).eq(criteria[key]);
				}
			});

			const results = await query.limit(1).exec();
			return results.length > 0 ? results[0] : null;
		} catch (error) {
			throw new Error(`GetOne operation failed: ${error.message}`);
		}
	}

	Services.getPopulatedMany = async (
		criteria,
		projection,
		populateQuery,
		options = {}
	) => {
		// DynamoDB doesn't support population like MongoDB
		// This would require separate queries and manual joining
		// For now, we'll just return the basic getMany results
		console.warn('Population is not directly supported in DynamoDB. Consider denormalizing data or implementing manual joins.');
		return await Services.getMany(criteria, projection, options);
	}

	Services.updateOne = async (criteria, dataToUpdate, options = {}) => {
		try {
			// First find the item
			const existingItem = await Services.getOne(criteria);
			
			if (!existingItem && options.upsert) {
				// Create new item if upsert is true
				const newItem = { ...criteria, ...dataToUpdate };
				return await Services.create(newItem);
			} else if (!existingItem) {
				return null;
			}

			// Update the existing item
			const updatedData = { ...existingItem, ...dataToUpdate };
			const updatedItem = await model.update({ id: existingItem.id }, updatedData, {
				returnValues: 'ALL_NEW',
			});

			return updatedItem;
		} catch (error) {
			throw new Error(`UpdateOne operation failed: ${error.message}`);
		}
	}

	Services.updateMany = async (criteria, dataToUpdate, options = {}) => {
		try {
			// Get all items matching criteria
			const items = await Services.getMany(criteria);
			const results = [];

			// Update each item individually
			for (const item of items) {
				const updatedItem = await model.update({ id: item.id }, dataToUpdate, {
					returnValues: 'ALL_NEW',
				});
				results.push(updatedItem);
			}

			return { modifiedCount: results.length, results };
		} catch (error) {
			throw new Error(`UpdateMany operation failed: ${error.message}`);
		}
	}

	Services.deleteOne = async (criteria) => {
		try {
			const item = await Services.getOne(criteria);
			if (!item) {
				return { deletedCount: 0 };
			}

			await model.delete({ id: item.id });
			return { deletedCount: 1 };
		} catch (error) {
			throw new Error(`DeleteOne operation failed: ${error.message}`);
		}
	}

	Services.deleteMany = async (criteria) => {
		try {
			const items = await Services.getMany(criteria);
			let deletedCount = 0;

			for (const item of items) {
				await model.delete({ id: item.id });
				deletedCount++;
			}

			return { deletedCount };
		} catch (error) {
			throw new Error(`DeleteMany operation failed: ${error.message}`);
		}
	}

	Services.count = async (criteria) => {
		try {
			let query = model.scan();
			
			// Apply filters based on criteria
			Object.keys(criteria).forEach(key => {
				if (criteria[key] !== undefined && criteria[key] !== null) {
					query = query.where(key).eq(criteria[key]);
				}
			});

			const results = await query.count().exec();
			return results.count;
		} catch (error) {
			throw new Error(`Count operation failed: ${error.message}`);
		}
	}

	Services.aggregate = async (group) => {
		// DynamoDB doesn't support aggregation like MongoDB
		// This would need to be implemented using scan/query operations and manual aggregation
		console.warn('Aggregation is not directly supported in DynamoDB. Consider using DynamoDB Streams or implementing manual aggregation.');
		throw new Error('Aggregation operations are not supported with DynamoDB. Please implement custom logic for your aggregation needs.');
	}

	return Services
}