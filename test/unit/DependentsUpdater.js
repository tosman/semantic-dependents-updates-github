import DependentsUpdater from '../../src/DependentsUpdater';

describe('DependentsUpdater', () => {
  describe('Run function', () => {
    it('shouldn\'t explode', () => {
      let x = new DependentsUpdater();
      x.run();
      expect(true);
    });

  });
});
