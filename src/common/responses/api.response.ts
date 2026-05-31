import { PaginatedResponse } from './paginated-api.response';

export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data: T;
  // Present only for paginated endpoints, hoisted out of the payload by ResponseInterceptor.
  meta?: PaginatedResponse<unknown>['meta'];
}