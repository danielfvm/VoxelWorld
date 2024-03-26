export enum ResourceType {
  FILE,
  AUDIO,
  TEXTURE,
}

export default class ResourceHandler {
  private static dataTable: {[url: string]: any} = {};

  public static async get(url: string, type: ResourceType = ResourceType.FILE): Promise<any> {
    const config = require('config');
    const path = config.path || "..";

    if (!ResourceHandler.has(url)) {
      switch (type) {
        case ResourceType.FILE:
          return ResourceHandler.dataTable[url] = await (await fetch(url.replace("..", path))).text();
        case ResourceType.AUDIO:
          return ResourceHandler.dataTable[url] = new Audio(url.replace("..", path));
        case ResourceType.TEXTURE:
          throw `Unimplemented type ${type}`;
      }
    }

    return ResourceHandler.dataTable[url];
  }

  public static has(url: string): boolean {
    return !!ResourceHandler.dataTable[url];
  }

  public static getSynced(url: string): any {
    if (!ResourceHandler.has(url)) {
      throw `Resource ${url} does not exist`;
    }
    return ResourceHandler.dataTable[url];
  }
}
