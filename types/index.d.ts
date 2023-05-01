/**
 * Sass render error or deprecation.
 */
export type SassRenderError = {
    /**
     * Full path to file or `stdin` with error or deprecation.
     */
    file: string;
    /**
     * Error or deprecation message.
     */
    message: string;
    /**
     * Stack trace of error or deprecation.
     */
    stack: string[];
    /**
     * Error or deprecation pattern source.
     */
    source: {
        start: {
            column: number;
            line: number;
        };
        end: {
            column: number;
            line: number;
        };
        pattern: string;
    };
    /**
     * Error or deprecation code or pattern of code.
     */
    type: 'error' | 'deprecation';
};
