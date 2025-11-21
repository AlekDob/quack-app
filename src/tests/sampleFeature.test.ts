import { describe, it, expect } from 'vitest';

// Sample feature test demonstrating basic Vitest usage
describe('Sample Feature', () => {
  it('should perform basic calculation', () => {
    const add = (a: number, b: number) => a + b;

    expect(add(2, 3)).toBe(5);
    expect(add(-1, 1)).toBe(0);
    expect(add(0, 0)).toBe(0);
  });

  it('should handle string concatenation', () => {
    const concat = (a: string, b: string) => `${a} ${b}`;

    expect(concat('Hello', 'World')).toBe('Hello World');
    expect(concat('Quack', 'App')).toBe('Quack App');
  });

  // Example of an async test
  it('should work with async operations', async () => {
    const fetchData = async () => {
      return new Promise<string>((resolve) => {
        setTimeout(() => resolve('Data loaded'), 100);
      });
    };

    const result = await fetchData();
    expect(result).toBe('Data loaded');
  });
});