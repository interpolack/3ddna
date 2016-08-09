## Running the Interface

1. Install Node.js from [its website](http://nodejs.org).
1. Clone this repository:

  ```
  git clone http://github.com/petepolack/3ddna
  ```
1. Initialize Node in that directory:

  ```
  cd 3ddna
  npm install
  node app.js
  ```
1. Point your browser to [port 5000](localhost:5000).
1. Load in data from `data/`:
  * 3D genome data `data/structure_n` or 2D genome data `data/hic_giant_zscore.txt`
  * External data: `data/data.tsv`, which has been compiled from multiple sources with `preprocess.py`.
  * Gene data: `data/mouse_genes.txt`
1. Launch the interface by clicking `Load`.
1. Once one or more chromosomes or bins are selected, press the `Enter` key to zoom in on them.

## Developer Notes

Going forward, we want to be able to support importing data at multiple **resolutions** (e.g., 1Mb, 200kb, 40kb) as well as from multiple **data types** (e.g., 3D structures, 2D matrices). Although we can currently import any one of these formats and compare them to others, the interface should support switching between these types flexibly. In some instances, even, these types should be combined; for example, when the same model is represented both by 2D and 3D data.

The current data preprocessing pipeline is as follows, which all occurs in the `loadData()` function:

1. Store imported data in the `results` array.
1. Use Model A (at `results[0]`) to determine:
  * the number of chromosomes in the data (store this in the `chromosomes` array)
  * the number of basepair bins in the data (store this in the `all` array)
  * which chromosomes correspond to which bins (store this in the `segments` array).
1. Iterate through all imported genome models `n`:
  * Represent it as `genome[n]`
  * Push its 3D coordinates to `genome[n].bins`
  * Append a new HTML `.genome` row to `#genomes`.
1. Iterate through all imported genome models `n`:
  * Calculate the average positions of each chromosome using `segments` and store the averages in `genome[n].chromosomes`.
1. If external data has been imported:
  * Push an element to `loaded` for each column header in the external data TSV in the format `["name", min, max]`
  * Push an array to `external` for each column in the external data TSV where each of the array indices corresponds to the column headers.
1. If gene data has been imported:
  * For each gene, determine which basepair bin it would be in (by rounding its position), and push the gene to the array at that index in `genes`.

As said, this allows for the importing of multiple datasets and comparing them side-by-side. However, because this is all done as *pre*-processing, it is not very flexible. A RESTful architecture (an API) would be more extensible:

1. Don't store imported data in memory.
1. When the user loads the interface, make a request for the highest-level data of each genome model. For example, if two genome models have been imported, one from a 2D contact map and another from a 3D structure, issue the following requests:

  ```
  /genome/2d/1
  /genome/3d/2
  ```
  Which will return the average chromosome positions for both models (therefore allowing them to be plotted in their respective graph, 3D viewer, and contact map).
    * If the user requests 3D data from the former 2D model like with `/genome/3d/1`, this may be impossible, so the interface need only return an error.
    * On the other hand, if the user requests 2D data from the latter 3D model like with `/genome/2d/2`, this is a simple conversion that back-end processing could handle and return.
    * *Of course, in the future, it may be possible to derive 3D coordinates from 2D data.*
1. When the user chooses to navigate to chromosome 6, issue the following requests:

  ```
  /genome/2d/1/6
  /genome/3d/2/6
  ```
  Which will return the bin positions for both models (therefore allowing them to be plotted in their respective graph, 3D viewer, and contact map).
1. When the user chooses to see this chromosome 6 at a higher resolution, say 200kb, issue the following requests:

  ```
  /genome/2d/1/6/200
  /genome/3d/2/6/200
  ```
  * Foreseeably, instead of needing to import higher-resolution data manually, the back-end can just downsample from a higher resolution (e.g., import 40kb data and downsample to 200kb and 1Mb)
1. When the user chooses to navigate to some selected bins on this chromosome, just use the above requests and filter out the irrelevant data.

This allows data to be processed on and retrieved from the back-end, as opposed to doing all preprocessing at launch as in the current prototype.
