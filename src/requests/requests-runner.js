import { get } from 'svelte/store';
import { token } from '../store';
class RequestRunner {
  constructor() {
    this.API_URL = HASURA_URL;
  }
  async fetchGraphQL(operationsDoc, operationName, variables) {
    const result = await fetch(this.API_URL, {
      method: 'POST',
      body: JSON.stringify({
        query: operationsDoc,
        variables: variables,
        operationName: operationName,
      }),
      headers: { Authorization: `Bearer ${get(token)}` },
    });
    return await result.json();
  }
  fetchMyQuery(operationsDoc) {
    return this.fetchGraphQL(operationsDoc, 'MyQuery', {});
  }

  async startFetchMyQuery(operationsDoc) {
    const { errors, data } = await this.fetchMyQuery(operationsDoc);

    if (errors) {
      // handle those errors like a pro
      console.error(errors);
    }

    // do something great with this precious data
    console.log(data);
    return data;
  }

  executeMyMutation(operationsDoc, variables = {}) {
    return this.fetchGraphQL(operationsDoc, 'MyMutation', variables);
  }

  async startExecuteMyMutation(operationsDoc, variables = {}) {
    const { errors, data } = await this.executeMyMutation(
      operationsDoc,
      variables,
    );

    if (errors) {
      // handle those errors like a pro
      console.error(errors);
    }

    // do something great with this precious data
    console.log(data);
    return data;
  }
}
export default new RequestRunner();
