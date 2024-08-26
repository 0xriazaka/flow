import { glob } from 'glob';


export const getMetadata = async (type: string)=> {
  if (type == "images") {
    return await glob('assets/metadata/images/*.png');
  }
  if (type == "attributes") {
    return await glob('assets/metadata/attributes/*.json');
  } else {
    throw "No metadata type match found."
  }
}