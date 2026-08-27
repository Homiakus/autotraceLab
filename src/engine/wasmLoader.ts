/**
 * Isomorphic WASM loader and runner for AutoTrace Go Core.
 */

export interface WasmBridgeInstance {
  isReady: boolean;
  request: (jsonRequest: string) => string;
}

declare global {
  interface Window {
    Go?: new () => {
      importObject: WebAssembly.Imports;
      run: (instance: WebAssembly.Instance) => Promise<void>;
    };
    businessOSAutoTraceRequest?: (jsonStr: string) => string;
  }
}

export class WasmLoader {
  private instance: WasmBridgeInstance | null = null;
  private loadPromise: Promise<WasmBridgeInstance> | null = null;

  async load(wasmUrl = '/autotrace.wasm'): Promise<WasmBridgeInstance> {
    if (this.instance && this.instance.isReady) {
      return this.instance;
    }
    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.initWasm(wasmUrl);
    return this.loadPromise;
  }

  private async initWasm(wasmUrl: string): Promise<WasmBridgeInstance> {
    // Check if global function already available
    if (typeof globalThis !== 'undefined' && (globalThis as any).businessOSAutoTraceRequest) {
      this.instance = {
        isReady: true,
        request: (jsonStr: string) => (globalThis as any).businessOSAutoTraceRequest(jsonStr),
      };
      return this.instance;
    }

    try {
      if (typeof window !== 'undefined' && window.Go) {
        const go = new window.Go();
        let wasmModule: WebAssembly.WebAssemblyInstantiatedSource;

        if (WebAssembly.instantiateStreaming) {
          wasmModule = await WebAssembly.instantiateStreaming(fetch(wasmUrl), go.importObject);
        } else {
          const response = await fetch(wasmUrl);
          const bytes = await response.arrayBuffer();
          wasmModule = await WebAssembly.instantiate(bytes, go.importObject);
        }

        // Run Go runtime in background
        go.run(wasmModule.instance);

        if ((globalThis as any).businessOSAutoTraceRequest) {
          this.instance = {
            isReady: true,
            request: (jsonStr: string) => (globalThis as any).businessOSAutoTraceRequest(jsonStr),
          };
          return this.instance;
        }
      }
    } catch (err) {
      console.warn('[WasmLoader] Go WASM instantiate skipped or unavailable in current env:', err);
    }

    // Fallback instance (returns ready false if binary wasn't loaded)
    this.instance = {
      isReady: typeof (globalThis as any).businessOSAutoTraceRequest === 'function',
      request: (jsonStr: string) => {
        if ((globalThis as any).businessOSAutoTraceRequest) {
          return (globalThis as any).businessOSAutoTraceRequest(jsonStr);
        }
        throw new Error('Go WASM engine is not loaded');
      },
    };
    return this.instance;
  }
}

export const defaultWasmLoader = new WasmLoader();
