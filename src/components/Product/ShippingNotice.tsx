export function ShippingNotice() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 md:p-8">
      <h2 className="text-xl font-bold text-red-600 mb-4">International Buyers - Please Note:</h2>
      <div className="space-y-4 text-gray-700">
        <p className="font-medium">We are a registered company and we do not ship items as a gift.</p>
        
        <p>Import duties, taxes, and charges are <span className="font-medium">not included</span> in the item price or shipping cost. These charges are the buyer's responsibility. Please check with your country's customs office to determine what these additional costs will be prior to bidding or buying.</p>
        
        <ul className="list-disc pl-5 space-y-2">
          <li>Packages will be sent by Serbia Post registered Air Mail (With Tracking Number).</li>
          <li>Tracking number will be uploaded to Paypal once the item is dispatched.</li>
          <li>EMS Speed Post, FedEx or DHL are available for extra cost, please contact us if you want the item to sent by this service</li>
          <li>All import taxes and duties will be handled by the buyer, for more information about the import tax please contact your local customs.</li>
          <li className="font-medium">We do not mark merchandise values below value or mark items as - gifts - The US and International government regulations prohibit such behavior.</li>
          <li>The Shipping cost includes postage, packing material, professional handling, ect.</li>
          <li>Shipping to Europe normally should takes 1-3 weeks to arrive</li>
          <li>Shipping to other countries normally should takes 3-5 weeks to arrive</li>
          <li>If you are not satisfy with our product or not receiving the item, please contact us.</li>
          <li>If you have any questions please feel free to contact us.</li>
          <li>Return items must stay unopened, please contact us before returning the item.</li>
          <li>Return shipping charges are handled by buyer and original shipping cost are not refundable</li>
          <li>For payment we accept PayPal as the only payment method.</li>
        </ul>
      </div>
    </div>
  );
}