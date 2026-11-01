// An error that carries an HTTP status code, e.g. throw new HttpError(404, "Not found")
class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

module.exports = HttpError;
