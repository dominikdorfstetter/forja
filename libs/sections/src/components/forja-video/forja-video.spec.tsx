import { render, h, describe, it, expect } from '@stencil/vitest';

describe('forja-video', () => {
  it('renders iframe for youtube (default provider)', async () => {
    const { root } = await render(
      <forja-video sectionTitle="Demo" videoUrl="https://youtube.com/embed/abc" />,
    );
    const iframe = root.querySelector('iframe')!;
    expect(iframe).not.toBeNull();
    expect(iframe.getAttribute('src')).toBe('https://youtube.com/embed/abc');
    expect(iframe.getAttribute('title')).toBe('Demo');
  });

  it('renders video element for self-hosted', async () => {
    const { root } = await render(<forja-video provider="self-hosted" videoUrl="/video.mp4" />);
    const video = root.querySelector('video')!;
    expect(video).not.toBeNull();
    expect(video.getAttribute('src')).toBe('/video.mp4');
    expect(video.querySelector('track')!.getAttribute('kind')).toBe('captions');
  });

  it('appends autoplay param for embeds', async () => {
    const { root } = await render(
      <forja-video videoUrl="https://youtube.com/embed/abc" autoplay />,
    );
    expect(root.querySelector('iframe')!.getAttribute('src')).toBe('https://youtube.com/embed/abc?autoplay=1');
  });

  it('applies aspect ratio class', async () => {
    const { root } = await render(<forja-video aspectRatio="4:3" />);
    expect(root.querySelector('section')!.className).toContain('forja-video--4-3');
  });
});
