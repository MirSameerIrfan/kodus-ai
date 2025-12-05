/**
 * EXEMPLO DE MIGRAÇÃO - AxiosMCPManagerService
 *
 * Este arquivo mostra como migrar o serviço para usar BaseSecureAxiosService
 *
 * Para aplicar: substituir o conteúdo de mcpManager.axios.ts por este código
 */

import { AxiosRequestConfig } from 'axios';
import { BaseSecureAxiosService } from '@/config/axios/base-secure-axios.service';

export class AxiosMCPManagerService extends BaseSecureAxiosService {
    constructor() {
        super(process.env.API_KODUS_SERVICE_MCP_MANAGER || '', {
            'Content-Type': 'application/json',
        });
    }

    // Métodos públicos com validação automática via interceptor
    public async get(url: string, config: AxiosRequestConfig = {}) {
        try {
            // Validação automática acontece no interceptor
            // Mas também validamos explicitamente para clareza
            return await this.secureGet(url, config);
        } catch (error) {
            // Logging melhorado (substituir console.log)
            console.error('AxiosMCPManagerService.get error:', error);
            throw error; // Re-throw para que o caller possa tratar
        }
    }

    public async post(
        url: string,
        body: Record<string, unknown> = {},
        config: AxiosRequestConfig = {},
    ) {
        // Validação automática + explícita
        return await this.securePost(url, body, config);
    }
}
