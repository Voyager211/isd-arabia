/**
 * Turns the connection failures people actually hit into instructions.
 *
 * Mongoose reports all three as terse driver errors that say nothing about the
 * cause, and all three are environmental rather than anything wrong with the
 * app — so the person reading the error is exactly the person who can fix it,
 * if they are told what it means.
 */
export function explainConnectionError(error: Error): string | null {
  const message = error.message;

  /**
   * `mongodb+srv://` needs an SRV lookup, and Node does NOT use the operating
   * system's DNS client for it — c-ares talks straight to the nameservers in
   * the adapter config over UDP/53.
   *
   * So this failure happens on machines where DNS is demonstrably fine:
   * `Resolve-DnsName` or `dig` will return the records while Node still gets
   * ECONNREFUSED, because Node is querying a different (often loopback, stale
   * VPN, or IPv6-only) resolver. Chasing "is my DNS working" is therefore a
   * dead end, which is why the first suggestion sidesteps SRV entirely.
   */
  if (/querySrv|_mongodb\._tcp|ENOTFOUND _mongodb/.test(message)) {
    return [
      'Node could not complete the SRV lookup that mongodb+srv:// requires.',
      'This is a resolver problem, not a credentials problem — the connection',
      'never got as far as authenticating.',
      '',
      'Note that Node does not use the OS DNS client here, so this can fail',
      'even when Resolve-DnsName or dig return the records perfectly well.',
      '',
      'Easiest fix — stop using SRV:',
      '  • In Atlas: Connect → Drivers → set the driver version to',
      '    "Node.js 2.2.12 or later". That gives a plain mongodb:// string',
      '    listing the replica-set hosts explicitly, with no SRV lookup at all.',
      '',
      'To see which nameservers Node is actually using:',
      '  node -e "console.log(require(\'dns\').getServers())"',
    ].join('\n');
  }

  if (/Authentication failed|bad auth/i.test(message)) {
    return [
      'Atlas rejected the credentials in MONGODB_URI.',
      '',
      '  • Check the database user and password under Atlas → Database Access.',
      '  • A password containing @ : / ? or # must be percent-encoded in the',
      '    URI. Atlas does not do this for you when you copy the string.',
    ].join('\n');
  }

  if (/timed out|ETIMEDOUT|ServerSelectionError/i.test(message)) {
    return [
      'Atlas did not answer in time. The usual cause is the IP allowlist:',
      'Atlas → Network Access → add your current IP address.',
      '',
      'Note that a home connection with a dynamic IP will need re-adding',
      'whenever it changes.',
    ].join('\n');
  }

  return null;
}
