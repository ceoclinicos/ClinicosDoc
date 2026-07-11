function apiError(res, status, error, detail, code) {
  const payload = { error };
  if (detail) payload.detail = detail;
  if (code) payload.code = code;
  return res.status(status).json(payload);
}

module.exports = { apiError };
