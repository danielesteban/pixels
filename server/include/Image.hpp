#ifndef IMAGE_HPP
#define IMAGE_HPP

#include <png.h>

class Image {
  public:
    Image(char *file_name);
    Image(char *buffer, size_t size);
    ~Image();
    int getStatus();
    int getWidth();
    int getHeight();
    png_byte* getPixel(int x, int y);
  private:
    void load(FILE *fp);
    int status, width, height, stride;
    png_bytep *row_pointers;
};

#endif
