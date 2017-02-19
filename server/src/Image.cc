#include <Image.hpp>
#include <stdlib.h>

Image::Image(char *file_name) {
  /* open file and test for it being a png */
  FILE *fp = fopen(file_name, "rb");
  if (!fp) {
    printf("[read_png_file] File %s could not be opened for reading", file_name);
    status = -1;
    return;
  }
  load(fp);
}

Image::Image(char *buffer, size_t size) {
  FILE *fp = fmemopen(buffer, size, "rb");
  if (!fp) {
    printf("[read_png_buffer] Buffer could not be opened for reading");
    status = -1;
    return;
  }
  load(fp);
}

void Image::load(FILE *fp) {
  /* 8 is the maximum size that can be checked */
  char header[8];
  fread(header, 1, 8, fp);
  if (png_sig_cmp((png_const_bytep) header, 0, 8)) {
    printf("[load_png] Image is not recognized as a PNG file");
    status = -1;
    return;
  }
  /* initialize stuff */
  png_structp png_ptr = png_create_read_struct(PNG_LIBPNG_VER_STRING, NULL, NULL, NULL);

  if (!png_ptr) {
    printf("[load_png] png_create_read_struct failed");
    fclose(fp);
    status = -1;
    return;
  }

  png_infop info_ptr = png_create_info_struct(png_ptr);
  if (!info_ptr) {
    printf("[load_png] png_create_info_struct failed");
    png_destroy_read_struct(&png_ptr, NULL, NULL);
    fclose(fp);
    status = -1;
    return;
  }

  if (setjmp(png_jmpbuf(png_ptr))) {
    printf("[load_png] Error during init_io");
    png_destroy_read_struct(&png_ptr, &info_ptr, NULL);
    fclose(fp);
    status = -1;
    return;
  }

  png_init_io(png_ptr, fp);
  png_set_sig_bytes(png_ptr, 8);
  png_read_info(png_ptr, info_ptr);

  width = png_get_image_width(png_ptr, info_ptr);
  height = png_get_image_height(png_ptr, info_ptr);
  stride = (png_get_color_type(png_ptr, info_ptr) == PNG_COLOR_TYPE_RGB) ? 3 : 4;
  // color_type = png_get_color_type(png_ptr, info_ptr);
  // bit_depth = png_get_bit_depth(png_ptr, info_ptr);
  // number_of_passes = png_set_interlace_handling(png_ptr);
  png_read_update_info(png_ptr, info_ptr);

  /* read file */
  if (setjmp(png_jmpbuf(png_ptr))) {
    printf("[load_png] Error during read_image");
    png_destroy_read_struct(&png_ptr, &info_ptr, NULL);
    fclose(fp);
    status = -1;
    return;
  }

  row_pointers = (png_bytep*) malloc(sizeof(png_bytep) * height);
  for (int y=0; y<height; y++) {
    row_pointers[y] = (png_byte*) malloc(png_get_rowbytes(png_ptr, info_ptr));
  }
  png_read_image(png_ptr, row_pointers);
  png_destroy_read_struct(&png_ptr, &info_ptr, NULL);
  fclose(fp);
  status = 0;
}

Image::~Image() {
  /* cleanup heap allocation */
  for (int y=0; y<height; y++) {
    free(row_pointers[y]);
  }
  free(row_pointers);
}

int Image::getStatus() {
  return status;
}

int Image::getWidth() {
  return width;
}

int Image::getHeight() {
  return height;
}

png_byte* Image::getPixel(int x, int y) {
  png_byte *row = row_pointers[y];
  return &(row[x*stride]);
}
