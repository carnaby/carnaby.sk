import { migrateLegacy } from './migrate-legacy';

describe('migrateLegacy', () => {
  it('should work', () => {
    expect(migrateLegacy()).toEqual('migrate-legacy');
  });
});
