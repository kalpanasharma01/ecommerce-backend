const { AppError } = require('../utils/helpers');

// Joi validation middleware: validate(schema, 'body' | 'query' | 'params')
module.exports = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
  if (error) {
    return next(new AppError('Validation failed', 400, error.details.map((d) => ({ field: d.path.join('.'), message: d.message }))));
  }
  req[source] = value;
  next();
};
