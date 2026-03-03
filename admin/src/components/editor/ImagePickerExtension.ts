import Image from '@tiptap/extension-image';

export interface ImagePickerOptions {
  onImageInsert?: () => void;
}

const ImagePickerExtension = Image.extend<ImagePickerOptions>({
  name: 'image',

  addOptions() {
    return {
      ...this.parent?.(),
      onImageInsert: undefined,
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      insertImageViaPicker:
        () =>
        () => {
          this.options.onImageInsert?.();
          return true;
        },
    };
  },
});

export default ImagePickerExtension;
