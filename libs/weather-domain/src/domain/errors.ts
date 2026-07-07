export class InvalidInputError extends Error {
  readonly code = 'BAD_USER_INPUT';
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

export class CityNotFoundError extends Error {
  readonly code = 'CITY_NOT_FOUND';
  constructor(city: string) {
    super(`No location found for "${city}".`);
    this.name = 'CityNotFoundError';
  }
}

export class UpstreamError extends Error {
  readonly code = 'UPSTREAM_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'UpstreamError';
  }
}
