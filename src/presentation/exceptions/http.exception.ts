/**
 * Returns HTTP error to client
 * @constructor
 * @status {number} HTTP response status
 * @code {string} Error code
 * @message {string} Error message
 * @details {object} Error details
 */
export class HttpException extends Error {
  public status: number
  public code: string
  public message: string
  public details?: object

  constructor({
    status,
    code,
    message,
    details,
  }: {
    status: number
    code: string
    message: string
    details?: object
  }) {
    super(message)
    this.status = status
    this.code = code
    this.message = message
    this.details = details
  }
}
