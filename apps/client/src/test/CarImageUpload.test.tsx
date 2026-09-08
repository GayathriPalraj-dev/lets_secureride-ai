import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CarImageUpload } from '../components/CarImageUpload';
vi.mock('../auth/useAuth', () => ({
  useAuth: () => ({ authorizeCarImage: vi.fn(), completeCarImage: vi.fn() }),
}));
const renderForm = () =>
  render(<CarImageUpload carId="c" revision={0} onUploaded={vi.fn()} />);
describe('car image upload', () => {
  it('renders an image input', () => {
    renderForm();
    expect(screen.getByLabelText('Image')).toHaveAttribute('type', 'file');
  });
  it('limits chooser MIME types', () => {
    renderForm();
    expect(screen.getByLabelText('Image')).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/webp',
    );
  });
  it('requires a file', () => {
    renderForm();
    expect(screen.getByLabelText('Image')).toBeRequired();
  });
  it('renders alt text input', () => {
    renderForm();
    expect(screen.getByLabelText('Alternative text')).toBeInTheDocument();
  });
  it('requires alt text', () => {
    renderForm();
    expect(screen.getByLabelText('Alternative text')).toBeRequired();
  });
  it('caps alt text at 160 characters', () => {
    renderForm();
    expect(screen.getByLabelText('Alternative text')).toHaveAttribute(
      'maxLength',
      '160',
    );
  });
  it('disables upload initially', () => {
    renderForm();
    expect(screen.getByRole('button', { name: 'Upload image' })).toBeDisabled();
  });
  it('keeps upload disabled with only alt text', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Alternative text'), {
      target: { value: 'Front' },
    });
    expect(screen.getByRole('button', { name: 'Upload image' })).toBeDisabled();
  });
  it('keeps upload disabled for blank alt text', () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Alternative text'), {
      target: { value: '   ' },
    });
    expect(screen.getByRole('button', { name: 'Upload image' })).toBeDisabled();
  });
  it('does not render progress before upload', () => {
    renderForm();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
  it('does not render a raw storage URL', () => {
    renderForm();
    expect(document.body.textContent).not.toContain('amazonaws');
  });
  it('uses a submit button for keyboard access', () => {
    renderForm();
    expect(
      screen.getByRole('button', { name: 'Upload image' }),
    ).toHaveAttribute('type', 'submit');
  });
});
