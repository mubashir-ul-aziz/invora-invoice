import { toast, useToastStore } from '../toastStore';

describe('toastStore', () => {
  beforeEach(() => {
    useToastStore.setState({ current: null });
  });

  it('shows a plain-string toast with its type', () => {
    toast.success('Invoice INV-1 created');

    expect(useToastStore.getState().current).toEqual(
      expect.objectContaining({ type: 'success', message: 'Invoice INV-1 created', title: undefined }),
    );
  });

  it('shows a titled toast', () => {
    toast.error({ title: "Couldn't save", message: 'Please try again.' });

    expect(useToastStore.getState().current).toEqual(
      expect.objectContaining({ type: 'error', title: "Couldn't save", message: 'Please try again.' }),
    );
  });

  it('ignores the same toast while it is still showing', () => {
    toast.success('Customer changes saved');
    const first = useToastStore.getState().current;

    toast.success('Customer changes saved');

    expect(useToastStore.getState().current).toBe(first);
  });

  it('replaces the showing toast with a different one', () => {
    toast.success('Line item added');
    const first = useToastStore.getState().current!;

    toast.error('Line item could not be added');

    const next = useToastStore.getState().current!;
    expect(next.id).not.toBe(first.id);
    expect(next).toEqual(expect.objectContaining({ type: 'error', message: 'Line item could not be added' }));
  });

  it('treats the same text with a different type as a different toast', () => {
    toast.success('Done');
    toast.error('Done');

    expect(useToastStore.getState().current?.type).toBe('error');
  });

  it('shows the same toast again once the previous one was dismissed', () => {
    toast.success('Payment deleted');
    const first = useToastStore.getState().current!;
    useToastStore.getState().dismiss(first.id);
    expect(useToastStore.getState().current).toBeNull();

    toast.success('Payment deleted');

    expect(useToastStore.getState().current?.id).not.toBe(first.id);
  });

  it('never lets a stale dismiss clear a newer toast', () => {
    toast.success('First');
    const first = useToastStore.getState().current!;
    toast.success('Second');

    useToastStore.getState().dismiss(first.id);

    expect(useToastStore.getState().current?.message).toBe('Second');
  });
});
