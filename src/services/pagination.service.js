export const paginateAggregate = async (
  model,
  pipeline,
  { page = 1, limit = 10, dataStages = [], withTotal = true } = {},
) => {
  const skip = (page - 1) * limit;

  const facet = {
    data: [
      { $skip: skip },
      { $limit: withTotal ? limit : limit + 1 },
      ...dataStages,
    ],
  };
  if (withTotal) facet.total = [{ $count: "count" }];

  const [result] = await model.aggregate([...pipeline, { $facet: facet }]);

  if (!withTotal) {
    const hasNextPage = result.data.length > limit;
    return {
      data: hasNextPage ? result.data.slice(0, limit) : result.data,
      pagination: { page, limit, hasNextPage, hasPrevPage: page > 1 },
    };
  }

  const total = result.total[0]?.count || 0;
  const totalPages = Math.ceil(total / limit);

  return {
    data: result.data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};
export const parsePagination = (
  { page, limit } = {},
  { defaultLimit = 10, maxLimit = 100 } = {},
) => {
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(
    maxLimit,
    Math.max(1, parseInt(limit, 10) || defaultLimit),
  );
  return {
    page: parsedPage,
    limit: parsedLimit,
    skip: (parsedPage - 1) * parsedLimit,
  };
};

export const buildPagination = (total, { page, limit }) => {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};
