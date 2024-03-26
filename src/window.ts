type Vector2 = [number, number];

export class FloatingWindow {
  private visible: boolean;
  private mouseStartPos: Vector2;

  // dom elements
  protected domElement: HTMLElement;
  protected domTitle: HTMLElement;

  // handles
  private _onMouseMove: (ev: MouseEvent) => void;
  private _onMouseDown: (ev: MouseEvent) => void;
  private _onMouseUp: (ev: MouseEvent) => void;
  private _onResize: () => void;

  constructor(name: string, pos: Vector2, size: Vector2) {
    this.createWindow();

    this.pos = pos;
    this.size = size;
    this.name = name;

    // create mouse event listeners
    window.addEventListener("mousemove", this._onMouseMove = this.onMouseMove.bind(this));
    window.addEventListener("mousedown", this._onMouseDown = this.onMouseDown.bind(this));
    window.addEventListener("mouseup", this._onMouseUp = this.onMouseUp.bind(this));
    window.addEventListener("resize", this._onResize = this.onResize.bind(this));
  }

  private onMouseMove(ev: MouseEvent) {
    if (!this.visible || !this.mouseStartPos)
      return;

    this.pos = this.clamp([ ev.clientX - this.mouseStartPos[0], ev.clientY - this.mouseStartPos[1] ]);
  }

  private onMouseDown(ev: MouseEvent) {
    if (ev.target !== this.domElement && ev.target !== this.domTitle)
      return;

    const mousePos: Vector2 = [ev.clientX, ev.clientY];
    const localPos: Vector2 = this.pos;
    const relativePos: Vector2 = [ mousePos[0] - localPos[0], mousePos[1] - localPos[1] ];
    this.mouseStartPos = this.visible && this.checkInBounds(mousePos) ? relativePos : null;
  }

  private onMouseUp(_: MouseEvent) {
    this.mouseStartPos = null;
  }

  private onResize() {
    this.pos = this.clamp(this.pos);
  }

  private clamp(pos: Vector2): Vector2 {
    return [
      Math.min(Math.max(0, pos[0]), window.innerWidth - this.size[0]), 
      Math.min(Math.max(0, pos[1]), window.innerHeight - this.size[1])
    ];
  }

  private checkInBounds(pos: Vector2): boolean {
    const localPos = this.pos;
    return (
      pos[0] > localPos[0] && pos[0] < localPos[0] + this.size[0] &&
      pos[1] > localPos[1] && pos[1] < localPos[1] + this.size[1]
    );
  }

  public destroy() {
    window.removeEventListener("mousemove", this._onMouseMove);
    window.removeEventListener("mousedown", this._onMouseDown);
    window.removeEventListener("mouseup", this._onMouseUp);
    window.removeEventListener("resize", this._onResize);
    document.body.removeChild(this.domElement);
  }

  protected createWindow() {
    // create window
    this.domElement = document.createElement("div");
    this.domElement.classList.add("floating-window");
    document.body.appendChild(this.domElement);

    // create title
    this.domTitle = document.createElement("div");
    this.domTitle.classList.add("floating-window-title");
    this.domElement.appendChild(this.domTitle);
  }

  public addButton(name: string, callback: () => void): HTMLElement {
    const button = document.createElement("button");
    button.innerText = name;
    button.addEventListener("click", callback);
    this.domElement.appendChild(button);

    return button;
  }

  public addSelection(name: string, selected: number, selections: string[], callback: (value: number) => void): HTMLSelectElement {
    const optionBody = document.createElement("div");
    optionBody.classList.add("floating-window-option-body");
    this.domElement.appendChild(optionBody);

    // create label
    const label = document.createElement("label");
    optionBody.appendChild(label);

    // create selection
    const selection = document.createElement("select");
    selection.id = name;
    selection.value = selected.toString();
    for (let i = 0; i < selections.length; i++) {
      const option = document.createElement("option");
      option.value = selections[i];
      option.innerText = selections[i];
      selection.appendChild(option);
    }

    selection.addEventListener("change", () => {
      callback(selections.indexOf(selection.value));      
    });
    optionBody.appendChild(selection);

    label.htmlFor = selection.id;
    label.innerText = name;

    return selection;
  }

  public addSlider(name: string, min: number, max: number, value: number, callback: (value: number) => void): HTMLInputElement {
    const optionBody = document.createElement("div");
    optionBody.classList.add("floating-window-option-body");
    this.domElement.appendChild(optionBody);

    // create label
    const label = document.createElement("label");
    optionBody.appendChild(label);

    // create slider
    const slider = document.createElement("input");
    slider.id = name;
    slider.type = "range";
    slider.min = min.toString();
    slider.max = max.toString();
    slider.value = value.toString();
    slider.addEventListener("input", () => callback(parseInt(slider.value)));
    slider.addEventListener("input", () => label.innerText = name + ": " + slider.value);
    optionBody.appendChild(slider);

    label.htmlFor = slider.id;
    label.innerText = name + ": " + slider.value;

    return slider;
  }

  public addCheckbox(name: string, value: boolean, callback: (value: boolean) => void): HTMLElement {
    const optionBody = document.createElement("div");
    optionBody.classList.add("floating-window-option-body");
    this.domElement.appendChild(optionBody);

    // create checkbox
    const checkbox = document.createElement("input");
    checkbox.id = name;
    checkbox.type = "checkbox";
    checkbox.checked = value;
    checkbox.addEventListener("input", () => callback(checkbox.checked));
    optionBody.appendChild(checkbox);

    // create label
    const label = document.createElement("label");
    label.htmlFor = checkbox.id;
    label.innerText = name;
    optionBody.appendChild(label);

    return checkbox;
  }

  public setVisible(visible: boolean) {
    this.visible = visible;
    this.domElement.style.display = visible ? "block" : "none";
  }

  public get name(): string {
    return this.domTitle.innerText;
  }

  public set name(name: string) {
    this.domTitle.innerText = name;
  }

  public set size(size: Vector2) {
    this.domElement.style.width = `${size[0]}px`;
    this.domElement.style.height = `${size[1]}px`;
  }

  public get size(): Vector2 {
    return [parseInt(this.domElement.style.width), parseInt(this.domElement.style.height)];
  }

  public set pos(pos: Vector2) {
    this.domElement.style.left = `${pos[0]}px`;
    this.domElement.style.top = `${pos[1]}px`;
  }

  public get pos(): Vector2 {
    return [parseInt(this.domElement.style.left), parseInt(this.domElement.style.top)];
  }
}
