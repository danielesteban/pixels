CXXFLAGS=-Wall -O3 -g
INCLUDE=include
OBJECTS=src/main.o src/Image.o
BINARIES=server

RGB_INCDIR=matrix/include
RGB_LIBDIR=matrix/lib
RGB_LIBRARY_NAME=rgbmatrix
RGB_LIBRARY=$(RGB_LIBDIR)/lib$(RGB_LIBRARY_NAME).a
LDFLAGS+=-L$(RGB_LIBDIR) -l$(RGB_LIBRARY_NAME) -lrt -lm -lpthread -lpng

all : $(BINARIES)

$(RGB_LIBRARY): FORCE
	$(MAKE) -C $(RGB_LIBDIR)

server : $(OBJECTS) $(RGB_LIBRARY)
	$(CXX) $< -o $@ src/Image.o $(LDFLAGS)

%.o : %.cc
	$(CXX) -I$(INCLUDE) -I$(RGB_INCDIR) $(CXXFLAGS) -c -o $@ $<

clean:
	rm -f $(OBJECTS) $(BINARIES)
	$(MAKE) -C $(RGB_LIBDIR) clean

FORCE:
.PHONY: FORCE
