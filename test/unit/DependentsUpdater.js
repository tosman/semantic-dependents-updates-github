import DependentsUpdater from '../../src/DependentsUpdater';

describe('DependentsUpdater', () => {
  describe('Greet function', () => {
    let x = new DependentsUpdater();
    beforeEach(() => {
      spy(x, 'greet');
      x.greet();
    });

    it('should have been run once', () => {
      expect(x.greet).to.have.been.calledOnce;
    });

    it('should have always returned hello', () => {
      expect(x.greet).to.have.always.returned('helios');
    });
  });
});
