import '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imagePickerExtension: {
      insertImageViaPicker: () => ReturnType;
    };
  }
}
