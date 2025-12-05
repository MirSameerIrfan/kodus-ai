import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { AxiosUrlValidator } from '@/shared/utils/axios-url-validator';

/**
 * Base class for secure Axios services
 *
 * Provides URL validation to prevent SSRF attacks when baseURL is configured.
 * All axios microservices should extend this class.
 */
export abstract class BaseSecureAxiosService {
    protected axiosInstance: AxiosInstance;

    constructor(baseURL: string, defaultHeaders?: Record<string, string>) {
        this.axiosInstance = axios.create({
            baseURL,
            headers: {
                'Content-Type': 'application/json',
                ...defaultHeaders,
            },
        });

        // Adicionar validação no interceptor de request
        this.setupSecurityInterceptors();
    }

    /**
     * Setup security interceptors to validate URLs
     */
    private setupSecurityInterceptors(): void {
        this.axiosInstance.interceptors.request.use(
            (config) => {
                // Validar URL se baseURL está configurado
                if (this.axiosInstance.defaults.baseURL && config.url) {
                    try {
                        AxiosUrlValidator.validateRelativeUrl(config.url);
                    } catch (error) {
                        const errorMessage =
                            error instanceof Error
                                ? error.message
                                : 'Invalid URL format';
                        throw new Error(
                            `[SSRF Protection] ${errorMessage}. ` +
                                `URL: ${config.url}, BaseURL: ${this.axiosInstance.defaults.baseURL}`,
                        );
                    }
                }
                return config;
            },
            (error) => Promise.reject(error),
        );
    }

    /**
     * Secure GET request with URL validation
     */
    protected async secureGet<T = any>(
        url: string,
        config: AxiosRequestConfig = {},
    ): Promise<T> {
        AxiosUrlValidator.validateRelativeUrl(url);
        const { data } = await this.axiosInstance.get<T>(url, config);
        return data;
    }

    /**
     * Secure POST request with URL validation
     */
    protected async securePost<T = any>(
        url: string,
        body: Record<string, unknown> = {},
        config: AxiosRequestConfig = {},
    ): Promise<T> {
        AxiosUrlValidator.validateRelativeUrl(url);
        const { data } = await this.axiosInstance.post<T>(url, body, config);
        return data;
    }

    /**
     * Secure PUT request with URL validation
     */
    protected async securePut<T = any>(
        url: string,
        body: Record<string, unknown> = {},
        config: AxiosRequestConfig = {},
    ): Promise<T> {
        AxiosUrlValidator.validateRelativeUrl(url);
        const { data } = await this.axiosInstance.put<T>(url, body, config);
        return data;
    }

    /**
     * Secure DELETE request with URL validation
     */
    protected async secureDelete<T = any>(
        url: string,
        config: AxiosRequestConfig = {},
    ): Promise<T> {
        AxiosUrlValidator.validateRelativeUrl(url);
        const { data } = await this.axiosInstance.delete<T>(url, config);
        return data;
    }

    /**
     * Get the axios instance (for advanced usage)
     * Note: Direct usage bypasses validation - use secure* methods instead
     */
    protected getAxiosInstance(): AxiosInstance {
        return this.axiosInstance;
    }
}
