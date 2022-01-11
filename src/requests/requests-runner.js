import { get } from 'svelte/store';
import { token, counter } from '../store';
class RequestRunner {
  constructor() {
    this.API_URL = HASURA_URL;
  }
  async fetchGraphQL(operationsDoc, operationName, variables) {
    try {
      const result = await fetch(this.API_URL, {
        method: 'POST',
        body: JSON.stringify({
          query: operationsDoc,
          variables: variables,
          operationName: operationName,
        }),
        headers: { Authorization: `Bearer ${get(token)}` },
      });
      return result.json();
    } catch (e) {
      console.error(e);
      throw new Error('Error with request sending');
    }
  }
  fetchMyQuery(operationsDoc) {
    return this.fetchGraphQL(operationsDoc, 'MyQuery', {});
  }

  async startFetchMyQuery(operationsDoc) {
    counter.update((n) => n + 1);
    const { errors, data } = await this.fetchMyQuery(operationsDoc);
    counter.update((n) => n - 1);
    if (errors) {
      // handle those errors like a pro
      console.error(errors);
      throw new Error(errors[0].message);
    }

    // do something great with this precious data
    console.log(data);
    return data;
  }

  executeMyMutation(operationsDoc, variables = {}) {
    return this.fetchGraphQL(operationsDoc, 'MyMutation', variables);
  }

  async startExecuteMyMutation(operationsDoc, variables = {}) {
    counter.update((n) => n + 1);
    const { errors, data } = await this.executeMyMutation(
      operationsDoc,
      variables,
    );
    counter.update((n) => n - 1);

    if (errors) {
      // handle those errors like a pro
      console.error(errors);
      throw new Error(errors[0].message);
    }

    // do something great with this precious data
    console.log(data);
    return data;
  }
}
export default new RequestRunner();
