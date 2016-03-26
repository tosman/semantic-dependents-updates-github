import DependentsUpdater from '../../src/semantic-dependents-updates-github';

describe('DependentsUpdater', () => {
  describe('Greet function', () => {
    beforeEach(() => {
      spy(DependentsUpdater, 'greet');
      DependentsUpdater.greet();
    });

    it('should have been run once', () => {
      expect(DependentsUpdater.greet).to.have.been.calledOnce;
    });

    it('should have always returned hello', () => {
      expect(DependentsUpdater.greet).to.have.always.returned('hello');
    });
  });
});
