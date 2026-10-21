type BaseServiceOptions = {
  debug?: boolean;
};

export class BaseService {
  protected debug: boolean;

  constructor({ debug }: BaseServiceOptions = {}) {
    this.debug = debug ?? false;
  }

  protected log() {
    throw new Error('Not implemented');
  }
}
