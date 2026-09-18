export const paginateAggregate = async (model, pipeline, { page = 1, limit = 10 } = {}) => {
  const skip = (page - 1) * limit;

  const [result] = await model.aggregate([
    ...pipeline,
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        total: [{ $count: "count" }],
      },
    },
  ]);

  const total = result.total[0]?.count || 0;

  return {
    data: result.data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1,
    },
  };
};