#include "led-matrix.h"
#include "transformer.h"
#include "graphics.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <netinet/in.h>
// #include <arpa/inet.h>
#include <math.h>
#include <signal.h>
#include <time.h>

#include "Image.hpp"

#define PORT 8080

using namespace rgb_matrix;

volatile bool interrupt_received = false;
static void InterruptHandler(int signo) {
  interrupt_received = true;
}

static void drawImage(FrameCanvas *canvas, char *buffer, size_t size) {
  Image* img = new Image(buffer, size);
  if (img->getStatus() != 0) return;
  int width = img->getWidth();
  int height = img->getHeight();
  // canvas->Clear();
  for (int y=0; y<height; y++) {
    for (int x=0; x<width; x++) {
      png_byte* ptr = img->getPixel(x, y);
      canvas->SetPixel(x, y, ptr[0], ptr[1], ptr[2]);
    }
  }
  delete img;
}

static void draw(RGBMatrix *matrix) {
  /* Setup socket stuff */
  int sock = socket(AF_INET, SOCK_STREAM, 0);
  if (sock < 0) {
    printf("ERROR opening socket\n");
    return;
  }
  int reuse = 1;
  if (setsockopt(sock, SOL_SOCKET, SO_REUSEADDR, (const char*)&reuse, sizeof(reuse)) < 0) {
    printf("setsockopt(SO_REUSEADDR) failed");
    return;
  }
  #ifdef SO_REUSEPORT
  if (setsockopt(sock, SOL_SOCKET, SO_REUSEPORT, (const char*)&reuse, sizeof(reuse)) < 0) {
    printf("setsockopt(SO_REUSEPORT) failed");
    return;
  }
  #endif

  struct sockaddr_in addr;
  bzero((char *) &addr, sizeof(addr));
  addr.sin_family = AF_INET;
  addr.sin_addr.s_addr = INADDR_ANY;
  addr.sin_port = htons(PORT);
  if (bind(sock, (struct sockaddr *) &addr, sizeof(addr)) < 0) {
    printf("ERROR on binding\n");
    return;
  }
  listen(sock, 5);

  /* Start listening for connections */
  FrameCanvas *canvas = matrix->CreateFrameCanvas();
  while(1) {
    if (interrupt_received) return;

    int result;
    struct timeval tv;
    fd_set rfds;
    FD_ZERO(&rfds);
    FD_SET(sock, &rfds);
    tv.tv_sec = 1;
    tv.tv_usec = 0;
    result = select(sock + 1, &rfds, (fd_set *) 0, (fd_set *) 0, &tv);
    if(result <= 0) continue;

    struct sockaddr_in client_addr;
    socklen_t client_addr_size = sizeof(client_addr);
    int client = accept(sock, (struct sockaddr *) &client_addr, &client_addr_size);
    if (client < 0) {
      // printf("ERROR on accept\n");
      continue;
    }
    /* Get image buffer size form the first two bytes */
    char sizeBuff[2];
    bzero(sizeBuff, 2);
    size_t n = read(client, sizeBuff, 2);
    if (n != 2) {
      // printf("ERROR reading file length from socket\n");
      close(client);
      continue;
    }
    size_t size = (sizeBuff[1] & 0xFF) << 8 | (sizeBuff[0] & 0xFF);
    /* Allocate & receive image buffer */
    char* buffer = new char[size];
    bzero(buffer, size);
    size_t received = 0;
    while(received < size) {
      n = read(client, buffer + received, size - received);
      if (n < 0) break;
      received += n;
    }
    if (received != size) {
      // printf("ERROR reading file from socket\n");
      delete[] buffer;
      close(client);
      continue;
    }
    /* Decode & render image buffer */
    // char ip[16];
    // inet_ntop(AF_INET, &(client_addr.sin_addr), ip, 16);
    // printf("[%s] %ubytes\n", ip, size);
    drawImage(canvas, buffer, size);
    delete[] buffer;
    canvas = matrix->SwapOnVSync(canvas);
    close(client);
  }
}

int main(int argc, char *argv[]) {
  RGBMatrix::Options defaults;
  defaults.rows = 32;
  defaults.chain_length = 2;
  RuntimeOptions runtime;
  runtime.gpio_slowdown = 0;
  runtime.daemon = 1;
  runtime.drop_privileges = 1;
  RGBMatrix *matrix = CreateMatrixFromFlags(&argc, &argv, &defaults, &runtime);
  if (matrix == NULL) return 1;
  matrix->ApplyStaticTransformer(RotateTransformer(180));

  signal(SIGTERM, InterruptHandler);
  signal(SIGINT, InterruptHandler);

  srand(time(NULL));
  draw(matrix);
  matrix->Clear();
  delete matrix;

  return 0;
}
