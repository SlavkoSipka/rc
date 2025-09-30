import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { Truck } from 'lucide-react';

export function ShippingPage() {
  return (
    <>
      <Header />
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex items-center gap-4 mb-8">
                <Truck className="w-8 h-8 text-blue-600" />
                <h1 className="text-3xl font-bold">Shipping Information</h1>
              </div>

              <div className="prose prose-blue max-w-none">
                <p className="text-gray-600 mb-8">
                  Our shipping prices are based on the value of the items in your order and on the service level you choose. 
                  When calculating your total shipping time, please keep in mind that the day the package is shipped or picked up 
                  from our shop is not considered the first business day; start counting business days from first full day that 
                  the package is "in transit" to you.
                </p>

                <h2 className="text-xl font-bold mb-4">Dispatch</h2>
                <p className="text-gray-600 mb-8">
                  All orders paid for by 2.45pm CET will be posted that same working day.
                </p>

                <h2 className="text-xl font-bold mb-4">Delivery Times</h2>
                <ul className="space-y-2 text-gray-600 mb-8">
                  <li>Deliveries to most parts of Europe take 7-12 working days.</li>
                  <li>Deliveries to the USA will take 10-15 working days</li>
                  <li>Overseas deliveries will take 14-21 working days.</li>
                </ul>

                <p className="text-gray-600 italic mb-8">
                  These are Serbia Post guidelines and may take longer due to busy times / holidays and customs clearance.
                </p>

                <div className="bg-blue-50 p-6 rounded-lg mb-8">
                  <p className="text-gray-700">
                    If you require a quicker, tracked or insured postage service, please contact us for extra options before paying.
                  </p>
                </div>

                <p className="text-gray-600">
                  Tracking is being uploaded as soon when the package is dispatched
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}